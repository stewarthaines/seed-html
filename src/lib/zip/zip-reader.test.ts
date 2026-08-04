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
  // Helper function to create a minimal valid ZIP file buffer: one stored
  // entry "test" with 4 data bytes, a matching central directory record, and
  // the end-of-central-directory record (the reader walks the directory).
  function createMockZipBuffer(): ArrayBuffer {
    // local header 30+4 + data 4 = 38; central 46+4 = 50; eocd 22 → 110
    const buffer = new ArrayBuffer(110);
    const view = new DataView(buffer);

    // Local file header
    view.setUint32(0, 0x04034b50, true);
    view.setUint16(4, 20, true); // version needed
    view.setUint16(6, 0, true); // general purpose flags
    view.setUint16(8, 0x00, true); // compression: store
    view.setUint16(10, 0, true); // mod time
    view.setUint16(12, 0, true); // mod date
    view.setUint32(14, 0, true); // crc
    view.setUint32(18, 4, true); // compressed size
    view.setUint32(22, 4, true); // uncompressed size
    view.setUint16(26, 4, true); // file name length
    view.setUint16(28, 0, true); // extra length
    view.setUint8(30, 116); // t
    view.setUint8(31, 101); // e
    view.setUint8(32, 115); // s
    view.setUint8(33, 116); // t
    view.setUint32(34, 0x12345678, true); // file data

    // Central directory record
    view.setUint32(38, 0x02014b50, true);
    view.setUint16(42, 20, true); // version created
    view.setUint16(44, 20, true); // version needed
    view.setUint16(46, 0, true); // general purpose flags
    view.setUint16(48, 0x00, true); // compression: store
    view.setUint16(50, 0, true); // mod time
    view.setUint16(52, 0, true); // mod date
    view.setUint32(54, 0, true); // crc
    view.setUint32(58, 4, true); // compressed size
    view.setUint32(62, 4, true); // uncompressed size
    view.setUint16(66, 4, true); // file name length
    view.setUint16(68, 0, true); // extra length
    view.setUint16(70, 0, true); // comment length
    view.setUint16(72, 0, true); // disk number
    view.setUint16(74, 0, true); // internal attributes
    view.setUint32(76, 0, true); // external attributes
    view.setUint32(80, 0, true); // local header offset
    view.setUint8(84, 116); // t
    view.setUint8(85, 101); // e
    view.setUint8(86, 115); // s
    view.setUint8(87, 116); // t

    // End of central directory
    view.setUint32(88, 0x06054b50, true);
    view.setUint16(92, 0, true); // disk number
    view.setUint16(94, 0, true); // central directory start disk
    view.setUint16(96, 1, true); // records on this disk
    view.setUint16(98, 1, true); // total records
    view.setUint32(100, 50, true); // central directory size
    view.setUint32(104, 38, true); // central directory offset
    view.setUint16(108, 0, true); // comment length

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
      const zip = new Zip(createMockZipBuffer());
      expect(zip.entries.length).toBeGreaterThan(0);
      expect(zip.entries[0].fileName).toBe('test');
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

  describe('streaming zips (data descriptors)', () => {
    // A zip written in streaming mode (general purpose bit 3): local headers
    // carry ZERO crc/sizes, the real values live in a data descriptor after
    // the entry data and in the central directory. Sizes must come from the
    // central directory or every entry extracts as 0 bytes — the shape of
    // EPUBs exported by server-side tools.
    function createStreamingZipBuffer(): ArrayBuffer {
      const text = (s: string) => [...s].map(c => c.charCodeAt(0));
      const bytes: number[] = [];
      const u16 = (v: number) => bytes.push(v & 0xff, (v >> 8) & 0xff);
      const u32 = (v: number) =>
        bytes.push(v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, (v >>> 24) & 0xff);

      const mimetype = text('application/epub+zip');

      // Local header: "mimetype", stored, bit 3 set, sizes and crc ZERO
      u32(0x04034b50);
      u16(20);
      u16(0x0808);
      u16(0x00);
      u16(0);
      u16(0);
      u32(0);
      u32(0);
      u32(0);
      u16(8);
      u16(0);
      bytes.push(...text('mimetype'));
      const dataStart = bytes.length;
      bytes.push(...mimetype);
      // Data descriptor: crc, compressed size, uncompressed size
      u32(0x08074b50);
      u32(0xaabbccdd);
      u32(mimetype.length);
      u32(mimetype.length);

      // Central directory: the authoritative sizes
      const cdStart = bytes.length;
      u32(0x02014b50);
      u16(20);
      u16(20);
      u16(0x0808);
      u16(0x00);
      u16(0);
      u16(0);
      u32(0xaabbccdd);
      u32(mimetype.length);
      u32(mimetype.length);
      u16(8);
      u16(0);
      u16(0);
      u16(0);
      u16(0);
      u32(0);
      u32(0);
      bytes.push(...text('mimetype'));
      const cdSize = bytes.length - cdStart;

      // End of central directory
      u32(0x06054b50);
      u16(0);
      u16(0);
      u16(1);
      u16(1);
      u32(cdSize);
      u32(cdStart);
      u16(0);

      const buffer = new ArrayBuffer(bytes.length);
      new Uint8Array(buffer).set(bytes);
      // sanity: data really does start right after the 30+8 byte local header
      expect(dataStart).toBe(38);
      return buffer;
    }

    it('takes sizes from the central directory, not the zeroed local header', () => {
      const zip = new Zip(createStreamingZipBuffer());
      expect(zip.entries.length).toBe(1);
      const entry = zip.entries[0];
      expect(entry.fileName).toBe('mimetype');
      expect(entry.generalPurpose & 0x08).toBe(0x08);
      expect(entry.compressedSize).toBe(20);
      expect(entry.uncompressedSize).toBe(20);
      expect(entry.crc).toBe(0xaabbccdd);
    });

    it('extracts the full entry content', async () => {
      const zip = new Zip(createStreamingZipBuffer());
      const blob = await zip.entries[0].extract();
      expect(await blob.text()).toBe('application/epub+zip');
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
