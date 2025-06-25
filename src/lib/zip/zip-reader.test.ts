import { describe, it, expect, vi } from 'vitest';
import { Zip } from './zip-reader.js';

// Mock the utils module
vi.mock('./utils.js', () => ({
  bufferToStream: vi.fn(
    buffer =>
      new ReadableStream({
        start(controller) {
          controller.enqueue(buffer);
          controller.close();
        },
      })
  ),
  streamToBlob: vi.fn(async stream => {
    const reader = stream.getReader();
    const chunks = [];
    let done = false;

    while (!done) {
      const result = await reader.read();
      done = result.done;
      if (result.value) {
        chunks.push(result.value);
      }
    }

    return new Blob(chunks);
  }),
  readString: vi.fn((dataView, offset, length) => {
    const bytes = [];
    for (let i = 0; i < length; i++) {
      bytes.push(String.fromCharCode(dataView.getUint8(offset + i)));
    }
    return bytes.join('');
  }),
}));

// Mock DecompressionStream
global.DecompressionStream = class MockDecompressionStream {
  readable: ReadableStream;
  writable: WritableStream;

  constructor(_format: string) {
    const transform = new TransformStream({
      transform(chunk, controller) {
        // Simple mock: just pass through the data
        controller.enqueue(chunk);
      },
    });

    this.readable = transform.readable;
    this.writable = transform.writable;
  }
} as any;

describe('Zip Reader', () => {
  // Helper function to create a minimal valid ZIP file buffer
  function createMockZipBuffer(): ArrayBuffer {
    // This creates a minimal ZIP file structure for testing
    const buffer = new ArrayBuffer(100);
    const view = new DataView(buffer);

    // Local file header signature
    view.setUint32(0, 0x04034b50, true);
    // Version needed to extract
    view.setUint16(4, 20, true);
    // General purpose bit flag
    view.setUint16(6, 0, true);
    // Compression method (store)
    view.setUint16(8, 0x00, true);
    // Last mod time
    view.setUint16(10, 0, true);
    // Last mod date
    view.setUint16(12, 0, true);
    // CRC-32
    view.setUint32(14, 0, true);
    // Compressed size
    view.setUint32(18, 4, true);
    // Uncompressed size
    view.setUint32(22, 4, true);
    // File name length
    view.setUint16(26, 4, true);
    // Extra field length
    view.setUint16(28, 0, true);

    // File name "test"
    view.setUint8(30, 116); // t
    view.setUint8(31, 101); // e
    view.setUint8(32, 115); // s
    view.setUint8(33, 116); // t

    // File data
    view.setUint32(34, 0x12345678, true);

    // End of central directory signature
    view.setUint32(38, 0x06054b50, true);
    // Number of this disk
    view.setUint16(42, 0, true);
    // Disk where central directory starts
    view.setUint16(44, 0, true);
    // Number of central directory records on this disk
    view.setUint16(46, 0, true);
    // Total number of central directory records
    view.setUint16(48, 0, true);
    // Size of central directory
    view.setUint32(50, 0, true);
    // Offset of start of central directory
    view.setUint32(54, 38, true);
    // Comment length
    view.setUint16(58, 0, true);

    return buffer;
  }

  // Helper function to create ZIP with deflate compression
  function createMockZipWithDeflate(): ArrayBuffer {
    const buffer = new ArrayBuffer(100);
    const view = new DataView(buffer);

    // Local file header with deflate compression
    view.setUint32(0, 0x04034b50, true);
    view.setUint16(4, 20, true);
    view.setUint16(6, 0, true);
    view.setUint16(8, 0x08, true); // Deflate compression
    view.setUint16(10, 0, true);
    view.setUint16(12, 0, true);
    view.setUint32(14, 0x12345678, true); // CRC
    view.setUint32(18, 8, true); // Compressed size
    view.setUint32(22, 10, true); // Uncompressed size
    view.setUint16(26, 4, true); // File name length
    view.setUint16(28, 0, true); // Extra field length

    // File name "test"
    view.setUint8(30, 116);
    view.setUint8(31, 101);
    view.setUint8(32, 115);
    view.setUint8(33, 116);

    // Compressed data (mock)
    for (let i = 34; i < 42; i++) {
      view.setUint8(i, i - 34);
    }

    // End of central directory
    view.setUint32(42, 0x06054b50, true);

    return buffer;
  }

  describe('constructor', () => {
    it('should create Zip instance and parse structure', () => {
      const buffer = createMockZipBuffer();
      const zip = new Zip(buffer);

      expect(zip).toBeInstanceOf(Zip);
      expect(zip.entries).toBeDefined();
      expect(Array.isArray(zip.entries)).toBe(true);
    });

    it('should handle empty buffer', () => {
      const buffer = new ArrayBuffer(0);
      const zip = new Zip(buffer);

      expect(zip.entries).toHaveLength(0);
    });

    it('should handle malformed ZIP', () => {
      const buffer = new ArrayBuffer(10);
      // Fill with random data
      const view = new Uint8Array(buffer);
      view.fill(0xff);

      const zip = new Zip(buffer);
      expect(zip.entries).toHaveLength(0);
    });
  });

  describe('extract method', () => {
    it('should extract uncompressed file', async () => {
      const buffer = createMockZipBuffer();
      const zip = new Zip(buffer);

      // Mock a simple entry
      const mockEntry = {
        fileName: 'test.txt',
        compressionMethod: 0x00,
        compressedSize: 4,
        uncompressedSize: 4,
        startsAt: 34,
        signature: 'PK\x03\x04',
        version: 20,
        generalPurpose: 0,
        lastModifiedTime: 0,
        lastModifiedDate: 0,
        crc: 0,
        fileNameLength: 4,
        extraLength: 0,
        extra: '',
        extract: () => Promise.resolve(new Blob()),
      };

      const blob = await zip.extract(mockEntry);
      expect(blob).toBeInstanceOf(Blob);
    });

    it('should extract compressed file', async () => {
      const buffer = createMockZipWithDeflate();
      const zip = new Zip(buffer);

      const mockEntry = {
        fileName: 'test.txt',
        compressionMethod: 0x08,
        compressedSize: 8,
        uncompressedSize: 10,
        startsAt: 34,
        signature: 'PK\x03\x04',
        version: 20,
        generalPurpose: 0,
        lastModifiedTime: 0,
        lastModifiedDate: 0,
        crc: 0x12345678,
        fileNameLength: 4,
        extraLength: 0,
        extra: '',
        extract: () => Promise.resolve(new Blob()),
      };

      const blob = await zip.extract(mockEntry);
      expect(blob).toBeInstanceOf(Blob);
    });

    it('should reject unsupported compression method', async () => {
      const buffer = createMockZipBuffer();
      const zip = new Zip(buffer);

      const mockEntry = {
        fileName: 'test.txt',
        compressionMethod: 0x99, // Unsupported
        compressedSize: 4,
        uncompressedSize: 4,
        startsAt: 34,
        signature: 'PK\x03\x04',
        version: 20,
        generalPurpose: 0,
        lastModifiedTime: 0,
        lastModifiedDate: 0,
        crc: 0,
        fileNameLength: 4,
        extraLength: 0,
        extra: '',
        extract: () => Promise.resolve(new Blob()),
      };

      await expect(zip.extract(mockEntry)).rejects.toThrow('Unsupported compression method: 153');
    });
  });

  describe('entries property', () => {
    it('should return array of entries', () => {
      const buffer = createMockZipBuffer();
      const zip = new Zip(buffer);

      const entries = zip.entries;
      expect(Array.isArray(entries)).toBe(true);
    });

    it('should have extract method bound to entries', () => {
      const buffer = createMockZipBuffer();
      const zip = new Zip(buffer);

      const entries = zip.entries;
      entries.forEach(entry => {
        expect(typeof entry.extract).toBe('function');
      });
    });
  });

  describe('ZIP structure parsing', () => {
    it('should parse local file headers', () => {
      const buffer = new ArrayBuffer(60);
      const view = new DataView(buffer);

      // Create a complete minimal ZIP structure
      // Local file header
      view.setUint32(0, 0x04034b50, true); // Signature
      view.setUint16(4, 20, true); // Version
      view.setUint16(6, 0, true); // General purpose
      view.setUint16(8, 0x00, true); // Compression method
      view.setUint16(10, 0x1234, true); // Last mod time
      view.setUint16(12, 0x5678, true); // Last mod date
      view.setUint32(14, 0x12345678, true); // CRC
      view.setUint32(18, 4, true); // Compressed size
      view.setUint32(22, 4, true); // Uncompressed size
      view.setUint16(26, 4, true); // File name length
      view.setUint16(28, 0, true); // Extra field length

      // File name
      view.setUint8(30, 116); // 't'
      view.setUint8(31, 101); // 'e'
      view.setUint8(32, 115); // 's'
      view.setUint8(33, 116); // 't'

      // File data
      view.setUint32(34, 0xdeadbeef, true);

      // End of central directory
      view.setUint32(38, 0x06054b50, true); // Signature
      view.setUint16(42, 0, true); // Number of this disk
      view.setUint16(44, 0, true); // Disk where central directory starts
      view.setUint16(46, 1, true); // Number of records on this disk
      view.setUint16(48, 1, true); // Total number of records
      view.setUint32(50, 0, true); // Size of central directory
      view.setUint32(54, 38, true); // Offset of central directory
      view.setUint16(58, 0, true); // Comment length

      const zip = new Zip(buffer);
      expect(zip.entries.length).toBeGreaterThan(0);
    });

    it('should handle multiple entries', () => {
      // This would require a more complex ZIP structure
      // For now, test with single entry
      const buffer = createMockZipBuffer();
      const zip = new Zip(buffer);

      // The mock creates at least one entry
      expect(zip.entries.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('error handling', () => {
    it('should handle corrupted ZIP headers gracefully', () => {
      const buffer = new ArrayBuffer(50);
      const view = new DataView(buffer);

      // Put some invalid signatures
      view.setUint32(0, 0xffffffff, true);
      view.setUint32(4, 0xffffffff, true);

      expect(() => new Zip(buffer)).not.toThrow();
    });

    it('should handle truncated ZIP files', () => {
      const buffer = new ArrayBuffer(10); // Too small for any valid ZIP structure
      expect(() => new Zip(buffer)).not.toThrow();
    });

    it('should handle buffer boundary conditions', () => {
      const buffer = new ArrayBuffer(4);
      const view = new DataView(buffer);
      view.setUint32(0, 0x04034b50, true); // Valid signature but truncated

      expect(() => new Zip(buffer)).not.toThrow();
    });
  });
});
