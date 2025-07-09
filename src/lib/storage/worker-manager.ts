/**
 * OPFS Worker Manager
 *
 * Manages Web Worker communication for OPFS sync operations.
 * Used primarily on Safari where sync access handles work better in workers.
 */

import type {
  WorkerMessage,
  WorkerResponse,
  WorkerMessageType,
  OperationResult,
  StorageQuota,
} from './types.js';
import workerScript from './opfs-worker.js?raw';

export class OPFSWorkerManager {
  private worker: Worker | null = null;
  private messageId = 0;
  private pendingMessages = new Map<
    number,
    { resolve: (value: unknown) => void; reject: (error: Error) => void }
  >();
  private timeout = 10000; // 10 second default timeout
  private isDestroyed = false;

  constructor() {
    this.initWorker();
  }

  private initWorker(): void {
    const blob = new Blob([workerScript], { type: 'application/javascript' });
    const workerURL = URL.createObjectURL(blob);

    this.worker = new Worker(workerURL);
    this.worker.onmessage = this.handleWorkerMessage.bind(this);
    this.worker.onerror = this.handleWorkerError.bind(this);
    this.worker.onmessageerror = this.handleWorkerMessageError.bind(this);

    // Clean up blob URL immediately
    URL.revokeObjectURL(workerURL);
  }

  private handleWorkerMessage(event: MessageEvent): void {
    const { result, id } = event.data as WorkerResponse;

    if (this.pendingMessages.has(id)) {
      const { resolve } = this.pendingMessages.get(id)!;
      this.pendingMessages.delete(id);
      resolve(result);
    }
  }

  private handleWorkerError(event: ErrorEvent): void {
    const error = new Error(`Worker error: ${event.message || 'Unknown error'}`);
    this.rejectAllPendingMessages(error);
  }

  private handleWorkerMessageError(_event: MessageEvent): void {
    const error = new Error('Worker message error: Failed to deserialize message');
    this.rejectAllPendingMessages(error);
  }

  private rejectAllPendingMessages(error: Error): void {
    for (const { reject } of this.pendingMessages.values()) {
      reject(error);
    }
    this.pendingMessages.clear();
  }

  async sendMessage(type: WorkerMessageType | string, data?: unknown): Promise<unknown> {
    if (this.isDestroyed) {
      throw new Error('Worker terminated');
    }

    if (!this.worker) {
      throw new Error('Worker not initialized');
    }

    return new Promise((resolve, reject) => {
      const id = ++this.messageId;
      this.pendingMessages.set(id, { resolve, reject });

      this.worker!.postMessage({ type, data, id } as WorkerMessage);

      setTimeout(() => {
        if (this.pendingMessages.has(id)) {
          this.pendingMessages.delete(id);
          reject(new Error(`Worker operation timed out after ${this.timeout}ms`));
        }
      }, this.timeout);
    });
  }

  setTimeout(timeout: number): void {
    this.timeout = timeout;
  }

  async createWorkspace(workspaceId: string): Promise<OperationResult<void>> {
    return (await this.sendMessage('createWorkspace', { workspaceId })) as OperationResult<void>;
  }

  async deleteWorkspace(workspaceId: string): Promise<OperationResult<void>> {
    return (await this.sendMessage('deleteWorkspace', { workspaceId })) as OperationResult<void>;
  }

  async listWorkspaces(): Promise<OperationResult<{ workspaces: string[] }>> {
    return (await this.sendMessage('listWorkspaces')) as OperationResult<{ workspaces: string[] }>;
  }

  async writeFile(
    workspaceId: string,
    path: string,
    content: ArrayBuffer
  ): Promise<OperationResult<void>> {
    return (await this.sendMessage('writeFile', {
      workspaceId,
      path,
      content,
    })) as OperationResult<void>;
  }

  async readFile(
    workspaceId: string,
    path: string
  ): Promise<OperationResult<{ content: ArrayBuffer }>> {
    return (await this.sendMessage('readFile', { workspaceId, path })) as OperationResult<{
      content: ArrayBuffer;
    }>;
  }

  async deleteFile(workspaceId: string, path: string): Promise<OperationResult<void>> {
    return (await this.sendMessage('deleteFile', { workspaceId, path })) as OperationResult<void>;
  }

  async listFiles(
    workspaceId: string,
    basePath?: string
  ): Promise<OperationResult<{ files: string[] }>> {
    return (await this.sendMessage('listFiles', { workspaceId, basePath })) as OperationResult<{
      files: string[];
    }>;
  }

  async getFileInfo(
    workspaceId: string,
    path: string
  ): Promise<OperationResult<{ fileInfo: { size: number; lastModified: Date } }>> {
    return (await this.sendMessage('getFileInfo', { workspaceId, path })) as OperationResult<{
      fileInfo: { size: number; lastModified: Date };
    }>;
  }

  async getQuota(): Promise<OperationResult<{ quota: StorageQuota }>> {
    return (await this.sendMessage('getQuota')) as OperationResult<{ quota: StorageQuota }>;
  }

  destroy(): void {
    if (this.isDestroyed) {
      return;
    }

    this.isDestroyed = true;

    // Reject all pending messages
    const error = new Error('Worker terminated');
    this.rejectAllPendingMessages(error);

    // Terminate worker
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }
}
