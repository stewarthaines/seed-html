/**
 * Mock ZIP entry for testing SOURCE.zip extraction
 */
export class MockZipEntry {
  constructor(
    public fileName: string,
    private content: ArrayBuffer,
    public compressedSize: number = content.byteLength,
    public uncompressedSize: number = content.byteLength,
    public crc32: number = 0,
    public lastModified: Date = new Date(),
    public compressionMethod: number = 0
  ) {}

  async extract(): Promise<Blob> {
    return new Blob([this.content]);
  }

  async extractAsArrayBuffer(): Promise<ArrayBuffer> {
    return this.content;
  }

  async extractAsText(): Promise<string> {
    return new TextDecoder().decode(this.content);
  }
}

/**
 * Mock ZIP reader for testing SOURCE.zip extraction
 */
export class MockZip {
  public entries: MockZipEntry[] = [];

  constructor(entries: Array<{ fileName: string; content: string | ArrayBuffer }> = []) {
    this.entries = entries.map(entry => {
      let content: ArrayBuffer;
      if (typeof entry.content === 'string') {
        const uint8 = new TextEncoder().encode(entry.content);
        content = uint8.buffer.slice(
          uint8.byteOffset,
          uint8.byteOffset + uint8.byteLength
        ) as ArrayBuffer;
      } else {
        content = entry.content;
      }
      return new MockZipEntry(entry.fileName, content);
    });
  }

  addEntry(fileName: string, content: string | ArrayBuffer): void {
    let buffer: ArrayBuffer;
    if (typeof content === 'string') {
      const uint8 = new TextEncoder().encode(content);
      buffer = uint8.buffer.slice(
        uint8.byteOffset,
        uint8.byteOffset + uint8.byteLength
      ) as ArrayBuffer;
    } else {
      buffer = content;
    }
    this.entries.push(new MockZipEntry(fileName, buffer));
  }
}

/**
 * Mock ZIP writer for testing SOURCE.zip creation
 */
export class MockZipWriter {
  private files: Array<{ filename: string; content: ArrayBuffer }> = [];
  private failureMode: string | null = null;

  setFailureMode(mode: 'addFile' | 'buildBlob' | null): void {
    this.failureMode = mode;
  }

  async addFile(filename: string, content: string | ArrayBuffer | Uint8Array): Promise<void> {
    if (this.failureMode === 'addFile') {
      throw new Error(`Failed to add file: ${filename}`);
    }

    let buffer: ArrayBuffer;
    if (typeof content === 'string') {
      const uint8 = new TextEncoder().encode(content);
      buffer = uint8.buffer.slice(
        uint8.byteOffset,
        uint8.byteOffset + uint8.byteLength
      ) as ArrayBuffer;
    } else if (content instanceof Uint8Array) {
      buffer = content.buffer.slice(
        content.byteOffset,
        content.byteOffset + content.byteLength
      ) as ArrayBuffer;
    } else {
      buffer = content;
    }

    this.files.push({ filename, content: buffer });
  }

  async buildBlob(): Promise<Blob> {
    if (this.failureMode === 'buildBlob') {
      throw new Error('Failed to build ZIP blob');
    }

    // Create a mock ZIP blob containing file information
    const mockZipData = {
      files: this.files.map(f => ({
        filename: f.filename,
        content: Array.from(new Uint8Array(f.content)),
        size: f.content.byteLength,
      })),
    };

    return new Blob([JSON.stringify(mockZipData)], {
      type: 'application/zip',
    });
  }

  /**
   * Test helper: Get added files for verification
   */
  getAddedFiles(): Array<{ filename: string; content: ArrayBuffer }> {
    return [...this.files];
  }

  /**
   * Test helper: Check if file was added
   */
  hasFile(filename: string): boolean {
    return this.files.some(f => f.filename === filename);
  }

  /**
   * Test helper: Get file content
   */
  getFileContent(filename: string): ArrayBuffer | null {
    const file = this.files.find(f => f.filename === filename);
    return file ? file.content : null;
  }

  /**
   * Test helper: Reset for new test
   */
  reset(): void {
    this.files = [];
    this.failureMode = null;
  }
}

/**
 * Factory functions for creating fresh mock instances in tests
 */
export function createMockZipWriter(): MockZipWriter {
  return new MockZipWriter();
}

export function createMockZip(
  entries: Array<{ fileName: string; content: string | ArrayBuffer }> = []
): MockZip {
  return new MockZip(entries);
}

/**
 * Helper function to create a mock SOURCE.zip with typical structure
 */
export function createMockSourceZip(): MockZip {
  return createMockZip([
    {
      fileName: 'SOURCE/settings.json',
      content: JSON.stringify({
        is_draft: false,
        draft_id: 1,
        text_transform: 'markdown-transform.js',
        dom_transforms: ['custom-dom.js'],
        version: '1.0.0',
      }),
    },
    {
      fileName: 'SOURCE/text/chapter1.txt',
      content: '# Chapter 1\n\nThis is the first chapter.',
    },
    {
      fileName: 'SOURCE/text/chapter2.txt',
      content: '# Chapter 2\n\nThis is the second chapter.',
    },
    {
      fileName: 'SOURCE/scripts/markdown-transform.js',
      content: 'function transformText(text) { return text; }',
    },
    {
      fileName: 'SOURCE/extensions/markdown-it/package.json',
      content: JSON.stringify({
        name: 'markdown-it',
        version: '1.0.0',
        main: 'index.js',
      }),
    },
    {
      fileName: 'SOURCE/extensions/markdown-it/index.js',
      content: 'module.exports = function() { return {}; };',
    },
  ]);
}

/**
 * Helper function to extract mock ZIP content for testing
 */
export async function extractMockZipContent(zipBlob: Blob): Promise<Record<string, ArrayBuffer>> {
  const text = await zipBlob.text();
  const mockData = JSON.parse(text);
  const result: Record<string, ArrayBuffer> = {};

  for (const file of mockData.files) {
    result[file.filename] = new Uint8Array(file.content).buffer;
  }

  return result;
}
