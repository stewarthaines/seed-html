/**
 * Test setup utilities for file storage API tests
 *
 * Provides mock implementations of browser APIs and test utilities
 * for consistent testing across different storage backends.
 */

import { vi } from 'vitest';
import type {
  StorageBackend,
  FileMetadata,
  StorageQuota,
  BackendType,
  OPFSFileHandle,
  OPFSDirectoryHandle,
  FileSystemWritableFileStream,
  FileSystemSyncAccessHandle,
} from './types.js';

/**
 * Mock implementations of browser APIs
 */
export class MockBrowserAPIs {
  static mockNavigator() {
    return {
      storage: {
        getDirectory: vi.fn(),
        estimate: vi.fn(),
      },
    };
  }

  static mockIndexedDB() {
    return {
      open: vi.fn(),
      deleteDatabase: vi.fn(),
    };
  }

  static mockURL() {
    return {
      createObjectURL: vi.fn(),
      revokeObjectURL: vi.fn(),
    };
  }

  static mockWorker() {
    return vi.fn();
  }

  static mockDocument() {
    return {
      createElement: vi.fn(),
      body: {
        appendChild: vi.fn(),
        removeChild: vi.fn(),
      },
    };
  }

  static mockWindow() {
    return {
      location: {
        protocol: 'https:',
        host: 'localhost:3000',
      },
      URL: this.mockURL(),
    };
  }

  static setupGlobalMocks() {
    vi.stubGlobal('navigator', this.mockNavigator());
    vi.stubGlobal('indexedDB', this.mockIndexedDB());
    vi.stubGlobal('URL', this.mockURL());
    vi.stubGlobal('Worker', this.mockWorker());
    vi.stubGlobal('document', this.mockDocument());
    vi.stubGlobal('window', this.mockWindow());
  }
}

/**
 * Mock OPFS file handle implementation
 */
export class MockOPFSFileHandle implements OPFSFileHandle {
  kind = 'file' as const;

  constructor(
    public name: string,
    private content: ArrayBuffer = new ArrayBuffer(0)
  ) {}

  async createWritable(): Promise<FileSystemWritableFileStream> {
    return {
      write: vi.fn(),
      close: vi.fn(),
      locked: false,
      abort: vi.fn(),
      getWriter: vi.fn()
    } as unknown as FileSystemWritableFileStream;
  }

  async createSyncAccessHandle(): Promise<FileSystemSyncAccessHandle> {
    return {
      read: vi.fn(),
      write: vi.fn(),
      flush: vi.fn(),
      close: vi.fn(),
      getSize: vi.fn().mockReturnValue(this.content.byteLength),
      truncate: vi.fn(),
    } as unknown as FileSystemSyncAccessHandle;
  }

  async getFile(): Promise<File> {
    return new File([this.content], this.name);
  }
}

/**
 * Mock OPFS directory handle implementation
 */
export class MockOPFSDirectoryHandle implements OPFSDirectoryHandle {
  kind = 'directory' as const;
  private files = new Map<string, MockOPFSFileHandle>();
  private directories = new Map<string, MockOPFSDirectoryHandle>();

  constructor(public name: string) {}

  async getFileHandle(name: string, options?: { create?: boolean }): Promise<OPFSFileHandle> {
    if (this.files.has(name)) {
      return this.files.get(name)!;
    }

    if (options?.create) {
      const fileHandle = new MockOPFSFileHandle(name);
      this.files.set(name, fileHandle);
      return fileHandle;
    }

    throw new Error(`File not found: ${name}`);
  }

  async getDirectoryHandle(
    name: string,
    options?: { create?: boolean }
  ): Promise<OPFSDirectoryHandle> {
    if (this.directories.has(name)) {
      return this.directories.get(name)!;
    }

    if (options?.create) {
      const dirHandle = new MockOPFSDirectoryHandle(name);
      this.directories.set(name, dirHandle);
      return dirHandle;
    }

    throw new Error(`Directory not found: ${name}`);
  }

  async removeEntry(name: string, _options?: { recursive?: boolean }): Promise<void> {
    if (this.files.has(name)) {
      this.files.delete(name);
      return;
    }

    if (this.directories.has(name)) {
      this.directories.delete(name);
      return;
    }

    throw new Error(`Entry not found: ${name}`);
  }

  async *entries(): AsyncIterableIterator<[string, OPFSFileHandle | OPFSDirectoryHandle]> {
    for (const [name, handle] of this.files) {
      yield [name, handle];
    }
    for (const [name, handle] of this.directories) {
      yield [name, handle];
    }
  }

  // Test utilities
  addFile(name: string, content: ArrayBuffer = new ArrayBuffer(0)): MockOPFSFileHandle {
    const fileHandle = new MockOPFSFileHandle(name, content);
    this.files.set(name, fileHandle);
    return fileHandle;
  }

  addDirectory(name: string): MockOPFSDirectoryHandle {
    const dirHandle = new MockOPFSDirectoryHandle(name);
    this.directories.set(name, dirHandle);
    return dirHandle;
  }
}

/**
 * Mock storage backend for testing
 */
export class MockStorageBackend implements StorageBackend {
  private workspaces = new Map<string, Map<string, ArrayBuffer>>();

  constructor(private backendType: BackendType = 'opfs-async') {}

  async createWorkspace(id: string): Promise<void> {
    this.workspaces.set(id, new Map());
  }

  async deleteWorkspace(id: string): Promise<void> {
    this.workspaces.delete(id);
  }

  async listWorkspaces(): Promise<string[]> {
    return Array.from(this.workspaces.keys());
  }

  async writeFile(workspaceId: string, path: string, content: ArrayBuffer): Promise<void> {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) {
      throw new Error(`Workspace not found: ${workspaceId}`);
    }
    workspace.set(path, content);
  }

  async readFile(workspaceId: string, path: string): Promise<ArrayBuffer> {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) {
      throw new Error(`Workspace not found: ${workspaceId}`);
    }
    const content = workspace.get(path);
    if (!content) {
      throw new Error(`File not found: ${path}`);
    }
    return content;
  }

  async deleteFile(workspaceId: string, path: string): Promise<void> {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) {
      throw new Error(`Workspace not found: ${workspaceId}`);
    }
    if (!workspace.delete(path)) {
      throw new Error(`File not found: ${path}`);
    }
  }

  async listFiles(workspaceId: string, basePath?: string): Promise<string[]> {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) {
      throw new Error(`Workspace not found: ${workspaceId}`);
    }

    const files = Array.from(workspace.keys());

    if (basePath) {
      return files.filter(path => path.startsWith(basePath + '/'));
    }

    return files;
  }

  async getFileInfo(workspaceId: string, path: string): Promise<{ size: number; lastModified: Date }> {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) {
      throw new Error(`Workspace not found: ${workspaceId}`);
    }
    const content = workspace.get(path);
    if (!content) {
      throw new Error(`File not found: ${path}`);
    }
    return {
      size: content.byteLength,
      lastModified: new Date()
    };
  }

  async getQuota(): Promise<StorageQuota> {
    return {
      used: 1000000,
      available: 9000000,
    };
  }

  getBackendType(): BackendType {
    return this.backendType;
  }
}

/**
 * Test data generators
 */
export class TestDataGenerator {
  static createWorkspaceId(): string {
    return `test-workspace-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  static createTextContent(size: number = 1024): ArrayBuffer {
    const text = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '
      .repeat(Math.ceil(size / 56))
      .substring(0, size);
    return new TextEncoder().encode(text).buffer as ArrayBuffer;
  }

  static createBinaryContent(size: number = 1024): ArrayBuffer {
    const buffer = new ArrayBuffer(size);
    const view = new Uint8Array(buffer);
    for (let i = 0; i < size; i++) {
      view[i] = Math.floor(Math.random() * 256);
    }
    return buffer;
  }

  static createEPUBStructure(): Map<string, ArrayBuffer> {
    const files = new Map<string, ArrayBuffer>();

    files.set('mimetype', new TextEncoder().encode('application/epub+zip').buffer as ArrayBuffer);
    files.set(
      'META-INF/container.xml',
      new TextEncoder().encode(`<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`).buffer as ArrayBuffer
    );

    files.set(
      'OEBPS/content.opf',
      new TextEncoder().encode(`<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="BookId" version="3.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>Test EPUB</dc:title>
    <dc:creator>Test Author</dc:creator>
    <dc:identifier id="BookId">test-epub-123</dc:identifier>
    <dc:language>en</dc:language>
  </metadata>
  <manifest>
    <item id="chapter1" href="chapter1.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine>
    <itemref idref="chapter1"/>
  </spine>
</package>`).buffer as ArrayBuffer
    );

    files.set(
      'OEBPS/chapter1.xhtml',
      new TextEncoder().encode(`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>Chapter 1</title>
</head>
<body>
  <h1>Chapter 1</h1>
  <p>This is the first chapter of the test EPUB.</p>
</body>
</html>`).buffer as ArrayBuffer
    );

    return files;
  }

  static createFileMetadata(name: string, size: number = 1024): FileMetadata {
    return {
      name,
      size,
      lastModified: Date.now(),
      type: name.endsWith('.xhtml') ? 'application/xhtml+xml' : 'text/plain',
    };
  }
}

/**
 * Test assertion helpers
 */
export class TestHelpers {
  static assertArrayBuffersEqual(actual: ArrayBuffer, expected: ArrayBuffer): void {
    const actualView = new Uint8Array(actual);
    const expectedView = new Uint8Array(expected);

    if (actualView.length !== expectedView.length) {
      throw new Error(
        `ArrayBuffer length mismatch: ${actualView.length} vs ${expectedView.length}`
      );
    }

    for (let i = 0; i < actualView.length; i++) {
      if (actualView[i] !== expectedView[i]) {
        throw new Error(
          `ArrayBuffer content mismatch at byte ${i}: ${actualView[i]} vs ${expectedView[i]}`
        );
      }
    }
  }

  static arrayBufferToString(buffer: ArrayBuffer): string {
    return new TextDecoder().decode(buffer);
  }

  static stringToArrayBuffer(str: string): ArrayBuffer {
    return new TextEncoder().encode(str).buffer as ArrayBuffer;
  }

  static async waitForCondition(
    condition: () => boolean | Promise<boolean>,
    timeout: number = 1000,
    interval: number = 10
  ): Promise<void> {
    const start = Date.now();

    while (Date.now() - start < timeout) {
      if (await condition()) {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, interval));
    }

    throw new Error(`Condition not met within ${timeout}ms`);
  }

  static mockAsyncIterable<T>(items: T[]): AsyncIterable<T> {
    return {
      async *[Symbol.asyncIterator]() {
        for (const item of items) {
          yield item;
        }
      },
    };
  }
}

/**
 * Performance testing utilities
 */
export class PerformanceTestHelpers {
  static async measureTime<T>(
    operation: () => Promise<T>
  ): Promise<{ result: T; duration: number }> {
    const start = performance.now();
    const result = await operation();
    const duration = performance.now() - start;
    return { result, duration };
  }

  static async runConcurrent<T>(
    operations: (() => Promise<T>)[],
    maxConcurrency: number = 10
  ): Promise<T[]> {
    const results: T[] = [];
    const executing: Promise<void>[] = [];

    for (const operation of operations) {
      const promise = operation().then(result => {
        results.push(result);
        executing.splice(executing.indexOf(promise), 1);
      });

      executing.push(promise);

      if (executing.length >= maxConcurrency) {
        await Promise.race(executing);
      }
    }

    await Promise.all(executing);
    return results;
  }

  static createMemoryPressure(sizeInMB: number = 100): ArrayBuffer[] {
    const buffers: ArrayBuffer[] = [];
    const bytesPerBuffer = 1024 * 1024; // 1MB per buffer

    for (let i = 0; i < sizeInMB; i++) {
      buffers.push(new ArrayBuffer(bytesPerBuffer));
    }

    return buffers;
  }
}

/**
 * Error simulation utilities
 */
export class ErrorSimulator {
  static createDOMException(name: string, message: string): DOMException {
    return new DOMException(message, name);
  }

  static createQuotaExceededError(): DOMException {
    return this.createDOMException('QuotaExceededError', 'Storage quota exceeded');
  }

  static createSecurityError(): DOMException {
    return this.createDOMException('SecurityError', 'The operation is insecure');
  }

  static createNotSupportedError(): DOMException {
    return this.createDOMException('NotSupportedError', 'The operation is not supported');
  }

  static createNetworkError(): Error {
    return new Error('NetworkError: Failed to fetch');
  }

  static createTimeoutError(): Error {
    return new Error('TimeoutError: Operation timed out');
  }
}
