/**
 * Mock implementation of BlobUrlManager for Transform Pipeline testing
 * Simulates library loading and global injection
 */
export class MockBlobUrlManager {
  private blobUrls = new Map<string, string>();
  private loadedLibraries = new Set<string>();
  private failureMode: string | null = null;
  private globals: Record<string, any> = {};

  constructor() {
    this.reset();
  }

  reset(): void {
    this.blobUrls.clear();
    this.loadedLibraries.clear();
    this.failureMode = null;
    this.globals = {};
  }

  /**
   * Set failure mode for testing error scenarios
   */
  setFailureMode(mode: 'create' | 'revoke' | 'load' | null): void {
    this.failureMode = mode;
  }

  /**
   * Create blob URL for file content
   */
  async createBlobUrl(
    content: ArrayBuffer,
    mimeType: string = 'application/javascript'
  ): Promise<string> {
    if (this.failureMode === 'create') {
      throw new Error('Failed to create blob URL');
    }

    const blobId = `blob:mock-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.blobUrls.set(blobId, new TextDecoder().decode(content));
    return blobId;
  }

  /**
   * Revoke blob URL
   */
  revokeBlobUrl(blobUrl: string): void {
    if (this.failureMode === 'revoke') {
      throw new Error('Failed to revoke blob URL');
    }
    this.blobUrls.delete(blobUrl);
  }

  /**
   * Load extension library and inject as global
   */
  async loadLibraryAsGlobal(
    workspaceId: string,
    libraryPath: string,
    globalName: string
  ): Promise<void> {
    if (this.failureMode === 'load') {
      throw new Error(`Failed to load library: ${libraryPath}`);
    }

    // Simulate library loading
    this.loadedLibraries.add(libraryPath);

    // Create mock library implementation based on global name
    this.globals[globalName] = this.createMockLibrary(globalName);
  }

  /**
   * Get loaded globals for transform execution context
   */
  getLoadedGlobals(): Record<string, any> {
    return { ...this.globals };
  }

  /**
   * Check if library is loaded
   */
  isLibraryLoaded(libraryPath: string): boolean {
    return this.loadedLibraries.has(libraryPath);
  }

  /**
   * Get all loaded library paths
   */
  getLoadedLibraries(): string[] {
    return Array.from(this.loadedLibraries);
  }

  /**
   * Create mock library implementations for testing
   */
  private createMockLibrary(globalName: string): any {
    switch (globalName) {
      case 'markdownit':
        return function (options: any = {}) {
          return {
            render: (text: string) => {
              // Simple mock markdown rendering
              return text
                .replace(/^# (.+)$/gm, '<h1>$1</h1>')
                .replace(/^## (.+)$/gm, '<h2>$1</h2>')
                .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                .replace(/\*(.+?)\*/g, '<em>$1</em>')
                .replace(/\n\n/g, '</p><p>')
                .replace(/^(?!<)(.+)$/gm, '<p>$1</p>')
                .replace(/<p><\/p>/g, '');
            },
            use: function (plugin: any) {
              return this;
            },
          };
        };

      case 'ABCJS':
        return {
          renderAbc: (elementId: string, abcString: string, options: any = {}) => {
            // Mock ABC notation rendering
            return `<div id="${elementId}" class="abcjs-rendered">${abcString}</div>`;
          },
          Editor: function (elementId: string, options: any = {}) {
            return {
              paramChanged: () => {
                /* mock noop */
              },
              setNotation: () => {
                /* mock noop */
              },
            };
          },
        };

      case 'Prism':
        return {
          highlight: (code: string, language: any, grammarName: string) => {
            return `<span class="token">${code}</span>`;
          },
          highlightAll: () => {
            /* mock noop */
          },
          languages: {
            javascript: {},
            css: {},
            html: {},
          },
        };

      default:
        // Generic mock library
        return {
          version: '1.0.0-mock',
          init: () => {
            /* mock noop */
          },
          process: (input: any) => input,
          render: (input: any) => `<div class="mock-${globalName}">${input}</div>`,
        };
    }
  }

  /**
   * Test helper: Simulate library loading from extensions
   */
  async simulateExtensionLibraryLoading(
    workspaceId: string,
    extensionLibraries: Array<{ path: string; globalName: string }>
  ): Promise<void> {
    for (const { path, globalName } of extensionLibraries) {
      await this.loadLibraryAsGlobal(workspaceId, path, globalName);
    }
  }

  /**
   * Test helper: Check if specific global is available
   */
  hasGlobal(globalName: string): boolean {
    return globalName in this.globals;
  }

  /**
   * Test helper: Get mock blob content
   */
  getBlobContent(blobUrl: string): string | undefined {
    return this.blobUrls.get(blobUrl);
  }
}

/**
 * Factory function for creating fresh mock instances in tests
 */
export function createMockBlobUrlManager(): MockBlobUrlManager {
  return new MockBlobUrlManager();
}
