import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { WorkerMessage, WorkerResponse, WorkerMessageType } from './types.js';
import { OPFSWorkerManager } from './worker-manager.js';

// Mock browser APIs
const mockURL = {
	createObjectURL: vi.fn(),
	revokeObjectURL: vi.fn()
};

const mockWorker = vi.fn();

vi.stubGlobal('URL', mockURL);
vi.stubGlobal('Worker', mockWorker);

describe('OPFS Worker Manager', () => {
	let workerManager: OPFSWorkerManager;
	let mockWorkerInstance: any;

	beforeEach(() => {
		mockWorkerInstance = {
			postMessage: vi.fn(),
			terminate: vi.fn(),
			addEventListener: vi.fn(),
			onmessage: null,
			onerror: null,
			onmessageerror: null
		};
		
		mockWorker.mockReturnValue(mockWorkerInstance);
		mockURL.createObjectURL.mockReturnValue('blob:mock-worker-url');
		
		workerManager = new OPFSWorkerManager();
	});

	afterEach(() => {
		vi.clearAllMocks();
		if (workerManager) {
			workerManager.destroy();
		}
	});

	describe('Worker Initialization', () => {
		it('should create worker with correct script', () => {
			expect(mockWorker).toHaveBeenCalledWith('blob:mock-worker-url');
			expect(mockURL.createObjectURL).toHaveBeenCalledWith(
				expect.objectContaining({
					type: 'application/javascript'
				})
			);
		});

		it('should set up message and error handlers', () => {
			expect(mockWorkerInstance.onmessage).toBeDefined();
			expect(mockWorkerInstance.onerror).toBeDefined();
			expect(mockWorkerInstance.onmessageerror).toBeDefined();
		});

		it('should revoke blob URL after worker creation', () => {
			expect(mockURL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-worker-url');
		});
	});

	describe('Message Communication', () => {
		it('should send message and receive response', async () => {
			const testData = { workspaceId: 'test', path: 'file.txt' };
			const expectedResponse = { success: true, data: 'result' };
			
			// Simulate worker response
			setTimeout(() => {
				if (mockWorkerInstance.onmessage) {
					mockWorkerInstance.onmessage({
						data: {
							type: 'writeFile',
							id: 1,
							result: expectedResponse
						}
					});
				}
			}, 0);

			const result = await workerManager.sendMessage('writeFile', testData);
			
			expect(result).toEqual(expectedResponse);
			expect(mockWorkerInstance.postMessage).toHaveBeenCalledWith({
				type: 'writeFile',
				id: 1,
				data: testData
			});
		});

		it('should handle multiple concurrent messages', async () => {
			const message1 = workerManager.sendMessage('writeFile', { path: 'file1.txt' });
			const message2 = workerManager.sendMessage('readFile', { path: 'file2.txt' });
			const message3 = workerManager.sendMessage('deleteFile', { path: 'file3.txt' });
			
			// Simulate responses in different order
			setTimeout(() => {
				if (mockWorkerInstance.onmessage) {
					// Response to message 2
					mockWorkerInstance.onmessage({
						data: { type: 'readFile', id: 2, result: { success: true, data: 'content2' } }
					});
					// Response to message 1
					mockWorkerInstance.onmessage({
						data: { type: 'writeFile', id: 1, result: { success: true } }
					});
					// Response to message 3
					mockWorkerInstance.onmessage({
						data: { type: 'deleteFile', id: 3, result: { success: true } }
					});
				}
			}, 0);

			const [result1, result2, result3] = await Promise.all([message1, message2, message3]);
			
			expect(result1).toEqual({ success: true });
			expect(result2).toEqual({ success: true, data: 'content2' });
			expect(result3).toEqual({ success: true });
		});

		it('should handle message timeout', async () => {
			// Set short timeout for testing
			workerManager.setTimeout(100);
			
			// Don't send any response
			await expect(workerManager.sendMessage('writeFile', {}))
				.rejects.toThrow('Worker operation timed out after 100ms');
		});

		it('should handle invalid message responses', async () => {
			setTimeout(() => {
				if (mockWorkerInstance.onmessage) {
					// Send malformed response
					mockWorkerInstance.onmessage({
						data: { /* missing required fields */ }
					});
				}
			}, 0);

			await expect(workerManager.sendMessage('writeFile', {}))
				.rejects.toThrow('Worker operation timed out');
		});

		it('should handle worker errors', async () => {
			const errorMessage = 'Worker script error';
			
			setTimeout(() => {
				if (mockWorkerInstance.onerror) {
					mockWorkerInstance.onerror(new ErrorEvent('error', { 
						message: errorMessage 
					}));
				}
			}, 0);

			await expect(workerManager.sendMessage('writeFile', {}))
				.rejects.toThrow('Worker error: Worker script error');
		});

		it('should handle worker message errors', async () => {
			setTimeout(() => {
				if (mockWorkerInstance.onmessageerror) {
					mockWorkerInstance.onmessageerror(new MessageEvent('messageerror'));
				}
			}, 0);

			await expect(workerManager.sendMessage('writeFile', {}))
				.rejects.toThrow('Worker message error: Failed to deserialize message');
		});
	});

	describe('Workspace Operations', () => {
		it('should create workspace', async () => {
			const workspaceId = 'test-workspace-123';
			
			setTimeout(() => {
				if (mockWorkerInstance.onmessage) {
					mockWorkerInstance.onmessage({
						data: {
							type: 'createWorkspace',
							id: 1,
							result: { success: true }
						}
					});
				}
			}, 0);

			const result = await workerManager.createWorkspace(workspaceId);
			
			expect(result).toEqual({ success: true });
			expect(mockWorkerInstance.postMessage).toHaveBeenCalledWith({
				type: 'createWorkspace',
				id: 1,
				data: { workspaceId }
			});
		});

		it('should delete workspace', async () => {
			const workspaceId = 'test-workspace-123';
			
			setTimeout(() => {
				if (mockWorkerInstance.onmessage) {
					mockWorkerInstance.onmessage({
						data: {
							type: 'deleteWorkspace',
							id: 1,
							result: { success: true }
						}
					});
				}
			}, 0);

			const result = await workerManager.deleteWorkspace(workspaceId);
			
			expect(result).toEqual({ success: true });
			expect(mockWorkerInstance.postMessage).toHaveBeenCalledWith({
				type: 'deleteWorkspace',
				id: 1,
				data: { workspaceId }
			});
		});

		it('should list workspaces', async () => {
			const expectedWorkspaces = ['workspace-1', 'workspace-2'];
			
			setTimeout(() => {
				if (mockWorkerInstance.onmessage) {
					mockWorkerInstance.onmessage({
						data: {
							type: 'listWorkspaces',
							id: 1,
							result: { success: true, workspaces: expectedWorkspaces }
						}
					});
				}
			}, 0);

			const result = await workerManager.listWorkspaces();
			
			expect(result).toEqual({ success: true, workspaces: expectedWorkspaces });
		});
	});

	describe('File Operations', () => {
		it('should write file', async () => {
			const workspaceId = 'test-workspace';
			const path = 'OEBPS/chapter1.xhtml';
			const content = new TextEncoder().encode('<html>Content</html>');
			
			setTimeout(() => {
				if (mockWorkerInstance.onmessage) {
					mockWorkerInstance.onmessage({
						data: {
							type: 'writeFile',
							id: 1,
							result: { success: true }
						}
					});
				}
			}, 0);

			const result = await workerManager.writeFile(workspaceId, path, content);
			
			expect(result).toEqual({ success: true });
			expect(mockWorkerInstance.postMessage).toHaveBeenCalledWith({
				type: 'writeFile',
				id: 1,
				data: { workspaceId, path, content }
			});
		});

		it('should read file', async () => {
			const workspaceId = 'test-workspace';
			const path = 'OEBPS/chapter1.xhtml';
			const expectedContent = new TextEncoder().encode('<html>Content</html>');
			
			setTimeout(() => {
				if (mockWorkerInstance.onmessage) {
					mockWorkerInstance.onmessage({
						data: {
							type: 'readFile',
							id: 1,
							result: { success: true, content: expectedContent }
						}
					});
				}
			}, 0);

			const result = await workerManager.readFile(workspaceId, path);
			
			expect(result).toEqual({ success: true, content: expectedContent });
		});

		it('should delete file', async () => {
			const workspaceId = 'test-workspace';
			const path = 'OEBPS/chapter1.xhtml';
			
			setTimeout(() => {
				if (mockWorkerInstance.onmessage) {
					mockWorkerInstance.onmessage({
						data: {
							type: 'deleteFile',
							id: 1,
							result: { success: true }
						}
					});
				}
			}, 0);

			const result = await workerManager.deleteFile(workspaceId, path);
			
			expect(result).toEqual({ success: true });
			expect(mockWorkerInstance.postMessage).toHaveBeenCalledWith({
				type: 'deleteFile',
				id: 1,
				data: { workspaceId, path }
			});
		});

		it('should list files', async () => {
			const workspaceId = 'test-workspace';
			const expectedFiles = ['file1.txt', 'file2.txt'];
			
			setTimeout(() => {
				if (mockWorkerInstance.onmessage) {
					mockWorkerInstance.onmessage({
						data: {
							type: 'listFiles',
							id: 1,
							result: { success: true, files: expectedFiles }
						}
					});
				}
			}, 0);

			const result = await workerManager.listFiles(workspaceId);
			
			expect(result).toEqual({ success: true, files: expectedFiles });
		});

		it('should list files in subdirectory', async () => {
			const workspaceId = 'test-workspace';
			const basePath = 'OEBPS';
			const expectedFiles = ['OEBPS/chapter1.xhtml', 'OEBPS/chapter2.xhtml'];
			
			setTimeout(() => {
				if (mockWorkerInstance.onmessage) {
					mockWorkerInstance.onmessage({
						data: {
							type: 'listFiles',
							id: 1,
							result: { success: true, files: expectedFiles }
						}
					});
				}
			}, 0);

			const result = await workerManager.listFiles(workspaceId, basePath);
			
			expect(result).toEqual({ success: true, files: expectedFiles });
			expect(mockWorkerInstance.postMessage).toHaveBeenCalledWith({
				type: 'listFiles',
				id: 1,
				data: { workspaceId, basePath }
			});
		});
	});

	describe('Quota Management', () => {
		it('should get storage quota', async () => {
			const expectedQuota = { used: 1000000, available: 9000000 };
			
			setTimeout(() => {
				if (mockWorkerInstance.onmessage) {
					mockWorkerInstance.onmessage({
						data: {
							type: 'getQuota',
							id: 1,
							result: { success: true, quota: expectedQuota }
						}
					});
				}
			}, 0);

			const result = await workerManager.getQuota();
			
			expect(result).toEqual({ success: true, quota: expectedQuota });
		});
	});

	describe('Resource Management', () => {
		it('should clean up resources on destroy', () => {
			workerManager.destroy();
			
			expect(mockWorkerInstance.terminate).toHaveBeenCalled();
		});

		it('should cancel pending operations on destroy', async () => {
			const operation = workerManager.sendMessage('writeFile', { path: 'test.txt' });
			
			workerManager.destroy();
			
			await expect(operation).rejects.toThrow('Worker terminated');
		});

		it('should handle multiple destroy calls safely', () => {
			workerManager.destroy();
			workerManager.destroy(); // Should not throw
			
			expect(mockWorkerInstance.terminate).toHaveBeenCalledTimes(1);
		});
	});

	describe('Error Recovery', () => {
		it('should handle worker unexpected termination', async () => {
			const operation = workerManager.sendMessage('writeFile', { path: 'test.txt' });
			
			// Simulate worker termination
			setTimeout(() => {
				if (mockWorkerInstance.onerror) {
					mockWorkerInstance.onerror(new ErrorEvent('error', { 
						message: 'Worker terminated unexpectedly' 
					}));
				}
			}, 0);

			await expect(operation).rejects.toThrow('Worker error: Worker terminated unexpectedly');
		});

		it('should reject pending operations when worker fails', async () => {
			const operation1 = workerManager.sendMessage('writeFile', { path: 'test1.txt' });
			const operation2 = workerManager.sendMessage('writeFile', { path: 'test2.txt' });
			
			// Simulate worker error
			setTimeout(() => {
				if (mockWorkerInstance.onerror) {
					mockWorkerInstance.onerror(new ErrorEvent('error', { 
						message: 'Fatal worker error' 
					}));
				}
			}, 0);

			await expect(operation1).rejects.toThrow('Worker error: Fatal worker error');
			await expect(operation2).rejects.toThrow('Worker error: Fatal worker error');
		});
	});

	describe('Performance Optimization', () => {
		it('should reuse worker for multiple operations', async () => {
			// Send multiple operations
			const operations = [
				workerManager.writeFile('ws1', 'file1.txt', new ArrayBuffer(0)),
				workerManager.writeFile('ws1', 'file2.txt', new ArrayBuffer(0)),
				workerManager.readFile('ws1', 'file1.txt')
			];

			// Simulate responses
			setTimeout(() => {
				if (mockWorkerInstance.onmessage) {
					mockWorkerInstance.onmessage({
						data: { type: 'writeFile', id: 1, result: { success: true } }
					});
					mockWorkerInstance.onmessage({
						data: { type: 'writeFile', id: 2, result: { success: true } }
					});
					mockWorkerInstance.onmessage({
						data: { type: 'readFile', id: 3, result: { success: true, content: new ArrayBuffer(0) } }
					});
				}
			}, 0);

			await Promise.all(operations);
			
			// Should have created only one worker
			expect(mockWorker).toHaveBeenCalledTimes(1);
		});

		it('should handle high-frequency operations', async () => {
			const operations = [];
			
			// Create 100 concurrent operations
			for (let i = 0; i < 100; i++) {
				operations.push(workerManager.writeFile('ws', `file${i}.txt`, new ArrayBuffer(0)));
			}

			// Simulate all responses
			setTimeout(() => {
				if (mockWorkerInstance.onmessage) {
					for (let i = 1; i <= 100; i++) {
						mockWorkerInstance.onmessage({
							data: { type: 'writeFile', id: i, result: { success: true } }
						});
					}
				}
			}, 0);

			const results = await Promise.all(operations);
			
			expect(results).toHaveLength(100);
			expect(results.every(r => r.success)).toBe(true);
		});
	});

	describe('Message Validation', () => {
		it('should validate message structure', async () => {
			setTimeout(() => {
				if (mockWorkerInstance.onmessage) {
					// Send response with missing id
					mockWorkerInstance.onmessage({
						data: { type: 'writeFile', result: { success: true } }
					});
				}
			}, 0);

			await expect(workerManager.sendMessage('writeFile', {}))
				.rejects.toThrow('Worker operation timed out');
		});

		it('should ignore responses for unknown message IDs', async () => {
			const operation = workerManager.sendMessage('writeFile', { path: 'test.txt' });
			
			setTimeout(() => {
				if (mockWorkerInstance.onmessage) {
					// Send response for unknown ID
					mockWorkerInstance.onmessage({
						data: { type: 'writeFile', id: 999, result: { success: true } }
					});
					
					// Send correct response
					mockWorkerInstance.onmessage({
						data: { type: 'writeFile', id: 1, result: { success: true } }
					});
				}
			}, 0);

			const result = await operation;
			expect(result).toEqual({ success: true });
		});
	});
});